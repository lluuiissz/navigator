<?php

namespace App\Http\Controllers\UIRenderer;

use App\Http\Controllers\Controller;
use App\Models\Facility;
use App\Models\Feedback;
use App\Models\Marker;
use App\Models\Note;
use App\Models\Report;
use App\Models\Route;
use App\Models\SearchLog;
use Illuminate\Http\Request;
use Inertia\Inertia;

class RenderController extends Controller
{
    public function login(){
        // Get statistics for the login page
        $stats = [
            'facilities' => Facility::count(),
            'markers' => Marker::count(),
            'routes' => Route::count(),
            'polygons' => \App\Models\FacilityPolygon::count(),
        ];

        return Inertia::render('auth/LoginPage', [
            'stats' => $stats
        ]);
    }
    public function register(){
        return Inertia::render('auth/Register');
    }

    public function verifyId(){
        return Inertia::render('auth/VerifyId');
    }
   public function facility(){
        $facilities = Facility::with([ 'marker', 'photos' ])->get();
        $markers = Marker::all();

        return Inertia::render('admin/Facility', [
            'markers' => $markers,
            'facilities' => $facilities,
            'message' => 'Facilities retrieved successfully.',
        ]);
    }

    public function renderMap(){
        return Inertia::render('map/Map');
    }
    public function searchlog(Request $request)
    {
        // Get page number from request (default to 1)
        $page = $request->get('page', 1);
        $perPage = 4; // Items per page

        // Get paginated search logs with guest relationship
        $searchLogs = SearchLog::with('guest')
            ->orderBy('search_at', 'desc')
            ->paginate($perPage, ['*'], 'page', $page);

        return Inertia::render('logs/SearchLogs', [
            'searchLogs' => $searchLogs->items(),
            'pagination' => [
                'current_page' => $searchLogs->currentPage(),
                'last_page' => $searchLogs->lastPage(),
                'total' => $searchLogs->total(),
                'per_page' => $searchLogs->perPage(),
                'from' => $searchLogs->firstItem(),
                'to' => $searchLogs->lastItem(),
            ]
        ]);
    }
    public function notes(){
        $notes = Note::with(['guest', 'marker'])->get();
        return Inertia::render('notes/Notes', [
            'notes' => $notes
        ]);
    }

     public function feedback(){
        $feedbacks = Feedback::with(['guest', 'marker'])->get();
        return Inertia::render('feedback/Feedback', [
            'feedbacks' => $feedbacks
        ]);
    }

}
