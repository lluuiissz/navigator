<?php

namespace App\Http\Controllers\Report;

use App\Http\Controllers\Controller;
use App\Models\Facility;
use App\Models\Feedback;
use App\Models\Guest;
use App\Models\Report;
use App\Models\SearchLog;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class ReportController extends Controller
{

    public function reportDetail(){

    }
    public function dashboard()
        {
            $reports = Report::where('status', 'published')
                ->orderBy('created_at', 'desc')
                ->paginate(10);

            return Inertia::render('reports/ReportsDashboard', [
                'reports' => $reports,
            ]);
        }
     /**
     * Generate usage report
     */
    public function generateUsageReport(Request $request)
    {
        $validated = $request->validate([
            'period_from' => 'required|date',
            'period_to' => 'required|date|after_or_equal:period_from',
            'title' => 'nullable|string|max:255',
        ]);

        $from = Carbon::parse($validated['period_from'])->startOfDay();
        $to = Carbon::parse($validated['period_to'])->endOfDay();

        // Collect usage data
        $data = [
            'total_searches' => SearchLog::whereBetween('search_at', [$from, $to])->count(),
            'unique_searchers' => SearchLog::whereBetween('search_at', [$from, $to])->distinct('guest_id')->count(),
            'top_searches' => SearchLog::whereBetween('search_at', [$from, $to])
                ->select('query', DB::raw('COUNT(*) as count'))
                ->groupBy('query')
                ->orderBy('count', 'desc')
                ->limit(10)
                ->get(),
            'guest_roles' => Guest::whereHas('searchLogs', function($q) use ($from, $to) {
                $q->whereBetween('search_at', [$from, $to]);
            })->select('role', DB::raw('COUNT(*) as count'))
                ->groupBy('role')
                ->get(),
            'daily_searches' => SearchLog::whereBetween('search_at', [$from, $to])
                ->select(DB::raw('DATE(search_at) as date'), DB::raw('COUNT(*) as count'))
                ->groupBy('date')
                ->get(),
        ];

        $report = Report::create([
            'title' => $validated['title'] ?? "Usage Report ({$from->format('Y-m-d')} to {$to->format('Y-m-d')})",
            'description' => 'System usage statistics including searches, users, and trends',
            'type' => 'usage',
            'generated_by' => auth()->id(),
            'data' => $data,
            'period_from' => $from,
            'period_to' => $to,
            'status' => 'published'
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Usage report generated successfully',
            'report' => $report
        ]);
    }

    /**
 * Generate feedback report
 */
public function generateFeedbackReport(Request $request)
{
    $validated = $request->validate([
        'period_from' => 'required|date',
        'period_to' => 'required|date|after_or_equal:period_from',
        'title' => 'nullable|string|max:255',
    ]);

    $from = Carbon::parse($validated['period_from'])->startOfDay();
    $to = Carbon::parse($validated['period_to'])->endOfDay();

    try {
        // Collect feedback data
        $allFeedback = Feedback::whereBetween('created_at', [$from, $to])
            ->with('guest', 'marker')
            ->get();

        $data = [
            'total_feedback' => $allFeedback->count(),
            'feedback_by_location' => $allFeedback->groupBy('marker_id')->map(function($items) {
                $firstItem = $items->first();
                return [
                    'location' => $firstItem?->marker?->label ?? 'Unknown',
                    'count' => $items->count()
                ];
            })->values(),
            'feedback_by_role' => $allFeedback->groupBy(function($item) {
                return $item->guest?->role ?? 'Unknown';
            })->map(function($items, $role) {
                return [
                    'role' => $role,
                    'count' => $items->count()
                ];
            })->values(),
            'sample_feedback' => $allFeedback->take(10)->map(function($fb) {
                return [
                    'guest' => $fb->guest?->name ?? 'Unknown',
                    'location' => $fb->marker?->label ?? 'Unknown',
                    'message' => $fb->message,
                    'date' => $fb->created_at->format('Y-m-d H:i')
                ];
            })->values(),
        ];

        $report = Report::create([
            'title' => $validated['title'] ?? "Feedback Report ({$from->format('Y-m-d')} to {$to->format('Y-m-d')})",
            'description' => 'Guest feedback analysis and trends',
            'type' => 'feedback',
            'generated_by' => Auth::id(),
            'data' => $data,
            'period_from' => $from,
            'period_to' => $to,
            'status' => 'published'
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Feedback report generated successfully',
            'report' => $report
        ]);
    } catch (\Exception $e) {
        Log::error('Feedback report error: ' . $e->getMessage() . ' | ' . $e->getFile() . ':' . $e->getLine());

        return response()->json([
            'success' => false,
            'message' => 'Failed to generate feedback report'
        ], 500);
    }
}

    /**
     * Generate facility report
     */
    public function generateFacilityReport(Request $request)
    {
        $validated = $request->validate([
            'title' => 'nullable|string|max:255',
        ]);

        // Collect facility data
        $facilities = Facility::with('marker')->get();

        $data = [
            'total_facilities' => $facilities->count(),
            'facilities_by_category' => $facilities->groupBy('category')->map(function($items) {
                return [
                    'category' => $items->first()->category,
                    'count' => $items->count()
                ];
            })->values(),
            'facilities_by_department' => $facilities->groupBy('department')->map(function($items) {
                return [
                    'department' => $items->first()->department,
                    'count' => $items->count()
                ];
            })->values(),
            'facilities_by_status' => $facilities->groupBy('status')->map(function($items) {
                return [
                    'status' => $items->first()->status,
                    'count' => $items->count()
                ];
            })->values(),
            'facility_details' => $facilities->map(function($facility) {
                return [
                    'name' => $facility->name,
                    'category' => $facility->category,
                    'department' => $facility->department,
                    'status' => $facility->status,
                    'location' => $facility->marker?->label ?? 'Unknown'
                ];
            }),
        ];

        $report = Report::create([
            'title' => $validated['title'] ?? "Facility Report - " . Carbon::now()->format('Y-m-d'),
            'description' => 'Comprehensive facility inventory and status overview',
            'type' => 'facility',
            'generated_by' => Auth::id(),
            'data' => $data,
            'period_from' => Carbon::now()->startOfYear(),
            'period_to' => Carbon::now(),
            'status' => 'published'
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Facility report generated successfully',
            'report' => $report
        ]);
    }

    /**
     * Generate search trends report
     */
    public function generateSearchTrendsReport(Request $request)
    {
        $validated = $request->validate([
            'period_from' => 'required|date',
            'period_to' => 'required|date|after_or_equal:period_from',
            'title' => 'nullable|string|max:255',
        ]);

        $from = Carbon::parse($validated['period_from'])->startOfDay();
        $to = Carbon::parse($validated['period_to'])->endOfDay();

        $data = [
            'total_searches' => SearchLog::whereBetween('search_at', [$from, $to])->count(),
            'unique_queries' => SearchLog::whereBetween('search_at', [$from, $to])->distinct('query')->count(),
            'top_10_searches' => SearchLog::whereBetween('search_at', [$from, $to])
                ->select('query', DB::raw('COUNT(*) as search_count'))
                ->groupBy('query')
                ->orderBy('search_count', 'desc')
                ->limit(10)
                ->get(),
            'bottom_10_searches' => SearchLog::whereBetween('search_at', [$from, $to])
                ->select('query', DB::raw('COUNT(*) as search_count'))
                ->groupBy('query')
                ->orderBy('search_count', 'asc')
                ->limit(10)
                ->get(),
            'hourly_distribution' => SearchLog::whereBetween('search_at', [$from, $to])
                ->select(DB::raw('HOUR(search_at) as hour'), DB::raw('COUNT(*) as count'))
                ->groupBy('hour')
                ->get(),
        ];

        $report = Report::create([
            'title' => $validated['title'] ?? "Search Trends Report ({$from->format('Y-m-d')} to {$to->format('Y-m-d')})",
            'description' => 'Analysis of search behavior and trending queries',
            'type' => 'search',
            'generated_by' => Auth::id(),
            'data' => $data,
            'period_from' => $from,
            'period_to' => $to,
            'status' => 'published'
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Search trends report generated successfully',
            'report' => $report
        ]);
    }

    /**
     * View single report
     */
    public function show(Report $report)
    {
        return Inertia::render('reports/ReportDetail', [
            'report' => $report,
        ]);
    }

    /**
     * Delete report
     */
    public function destroy(Report $report)
    {
        $report->delete();

        return response()->json([
            'success' => true,
            'message' => 'Report deleted successfully'
        ]);
    }
}
