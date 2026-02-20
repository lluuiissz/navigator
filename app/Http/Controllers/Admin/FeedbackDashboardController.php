<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Feedback;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class FeedbackDashboardController extends Controller
{
    /**
     * Display the feedback dashboard
     */
    public function index(Request $request)
    {
        $query = Feedback::query()
            ->with(['guest', 'marker'])
            ->join('guests', 'feedbacks.guest_id', '=', 'guests.id')
            ->leftJoin('users', 'guests.user_id', '=', 'users.id')
            ->leftJoin('allowed_ids', 'users.id_number', '=', 'allowed_ids.id_number')
            ->select([
                'feedbacks.*',
                'guests.name as nickname',
                'users.id_number',
                'allowed_ids.full_name',
                'allowed_ids.course',
            ]);

        // Search filter
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('users.id_number', 'like', "%{$search}%")
                  ->orWhere('allowed_ids.full_name', 'like', "%{$search}%")
                  ->orWhere('guests.name', 'like', "%{$search}%")
                  ->orWhere('feedbacks.message', 'like', "%{$search}%");
            });
        }

        // Course filter
        if ($request->has('course') && $request->course !== 'all') {
            $query->where('allowed_ids.course', $request->course);
        }

        // Date range filter
        if ($request->has('date_from')) {
            $query->whereDate('feedbacks.created_at', '>=', $request->date_from);
        }
        if ($request->has('date_to')) {
            $query->whereDate('feedbacks.created_at', '<=', $request->date_to);
        }

        $feedbacks = $query->orderBy('feedbacks.created_at', 'desc')->paginate(20);

        // Get unique courses for filter dropdown
        $courses = DB::table('allowed_ids')
            ->whereNotNull('course')
            ->distinct()
            ->pluck('course')
            ->filter()
            ->values();

        return Inertia::render('admin/FeedbackDashboard', [
            'feedbacks' => $feedbacks,
            'courses' => $courses,
            'filters' => $request->only(['search', 'course', 'date_from', 'date_to'])
        ]);
    }

    /**
     * Export feedback to CSV
     */
    public function export(Request $request)
    {
        $query = Feedback::query()
            ->join('guests', 'feedbacks.guest_id', '=', 'guests.id')
            ->leftJoin('users', 'guests.user_id', '=', 'users.id')
            ->leftJoin('allowed_ids', 'users.id_number', '=', 'allowed_ids.id_number')
            ->leftJoin('markers', 'feedbacks.marker_id', '=', 'markers.id')
            ->select([
                'users.id_number',
                'guests.name as nickname',
                'allowed_ids.full_name',
                'allowed_ids.course',
                'feedbacks.message',
                'markers.label as location',
                'feedbacks.created_at'
            ]);

        // Apply same filters as index
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('users.id_number', 'like', "%{$search}%")
                  ->orWhere('allowed_ids.full_name', 'like', "%{$search}%")
                  ->orWhere('guests.name', 'like', "%{$search}%");
            });
        }

        if ($request->has('course') && $request->course !== 'all') {
            $query->where('allowed_ids.course', $request->course);
        }

        if ($request->has('date_from')) {
            $query->whereDate('feedbacks.created_at', '>=', $request->date_from);
        }
        if ($request->has('date_to')) {
            $query->whereDate('feedbacks.created_at', '<=', $request->date_to);
        }

        $feedbacks = $query->orderBy('feedbacks.created_at', 'desc')->get();

        // Generate CSV
        $filename = 'feedback_export_' . date('Y-m-d_His') . '.csv';
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];

        $callback = function() use ($feedbacks) {
            $file = fopen('php://output', 'w');
            
            // Header row
            fputcsv($file, ['ID Number', 'Nickname', 'Full Name', 'Course', 'Message', 'Location', 'Date']);

            // Data rows
            foreach ($feedbacks as $feedback) {
                fputcsv($file, [
                    $feedback->id_number ?? 'N/A',
                    $feedback->nickname ?? 'Guest',
                    $feedback->full_name ?? 'N/A',
                    $feedback->course ?? 'N/A',
                    $feedback->message,
                    $feedback->location ?? 'Unknown',
                    $feedback->created_at->format('Y-m-d H:i:s')
                ]);
            }

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }
}
