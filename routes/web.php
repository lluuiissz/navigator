<?php

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Facilty\FacilityController;
use App\Http\Controllers\FacilityPhotoController;
use App\Http\Controllers\FacilityPolygonController;
use App\Http\Controllers\Feedback\FeedbackController;
use App\Http\Controllers\GeocodingController;
use App\Http\Controllers\Guest\GuestController;
use App\Http\Controllers\Logs\SearchLogsController;
use App\Http\Controllers\Marker\markerController;
use App\Http\Controllers\Notes\NoteController;
use App\Http\Controllers\Route\RouteController;
use App\Http\Controllers\UIRenderer\RenderController;
use App\Models\Facility;
use App\Models\Marker;
use App\Models\Note;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;








Route::get('/', function () {
    $facilities = Facility::with([
        'marker.notes.guest',
        'marker.feedbacks.guest',
        'photos.guest',
    ])->get();

    // Get all notes (frontend will filter by guest_id)
    $notes = Note::with(['marker', 'guest'])
        ->get()
        ->map(function($note) {
            return [
                'id' => $note->id,
                'content' => $note->content,
                'marker_id' => $note->marker_id,
                'guest_id' => $note->guest_id,
                'created_at' => $note->created_at,
                'updated_at' => $note->updated_at,
                'guest' => $note->guest ? [
                    'id' => $note->guest->id,
                    'name' => $note->guest->name
                ] : null
            ];
        });

    // Get all facility polygons
    $polygons = \App\Models\FacilityPolygon::all();

    return Inertia::render('guest/Index', [
        'facilities' => $facilities,
        'notes' => $notes,
        'polygons' => $polygons,
    ]);
});

// AR Navigation Demo Route
Route::get('/demo/ar', function () {
    return Inertia::render('demo/ARDemo');
})->name('ar.demo');

Route::post('/create/feedback', [FeedbackController::class, 'store'])->name('feedback.create');
Route::post('/search-logs', [SearchLogsController::class, 'store'])->name('search.create');

Route::get('/private-routes', [RouteController::class, 'index']);
Route::get('/routes/export/geojson-pub', [RouteController::class, 'exportGeoJSON']);

// Facility Polygon Routes (Public - for viewing)
Route::get('/facilities/polygons', [FacilityPolygonController::class, 'index']);
Route::get('/pub/facilities/{facility}/photos', [FacilityPhotoController::class, 'index']);
Route::post('/pub/facilities/{facility}/photos', [FacilityPhotoController::class, 'store']);

Route::post('/guests', [GuestController::class, 'store'])->name('guest');

Route::get('/login', [RenderController::class, 'login'])->name('login');
Route::post('/auth/check-email', [AuthController::class, 'isEmailExist'])->name('email.exist');
Route::post('/login', [AuthController::class, 'login'])->name('login.post');
Route::post('/auth/login', [AuthController::class, 'login'])->name('auth.login');

Route::get('/register', [RenderController::class, 'register'])->name('register')->middleware('admin.register');
Route::post('/register', [AuthController::class, 'register'])->name('register.post');

Route::middleware('auth')->group(function () {
    Route::get('/notes', [RenderController::class, 'notes'])->name('notes.index');
    Route::get('/dashboard', [RenderController::class, 'dashboard'])->name('dashboard');
       // Facility Routes - FIXED
    Route::get('/facilities', [RenderController::class, 'facility'])->name('facility.get');

    Route::get('/map', [RenderController::class, 'renderMap'])->name('map.get');
    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');

    require __DIR__.'/marker/marker.php';
    require __DIR__.'/facility/facility.php';
    require __DIR__.'/feedback/feedback.php';
    require __DIR__.'/logs/searchlog.php';
    require __DIR__.'/auth/auth.php';
    require __DIR__.'/report/report.php';
    require __DIR__.'/route/route.php';
    require __DIR__.'/auth/profile/profile.php';

    Route::get('/search-logs', [RenderController::class, 'searchlog'])->name('logs.index');

    // Facility Polygon Routes (Admin only)
    Route::post('/facilities/polygons', [FacilityPolygonController::class, 'store']);
    Route::get('/facilities/polygons/{facilityPolygon}', [FacilityPolygonController::class, 'show']);
    Route::put('/facilities/polygons/{facilityPolygon}', [FacilityPolygonController::class, 'update']);
    Route::delete('/facilities/polygons/{facilityPolygon}', [FacilityPolygonController::class, 'destroy']);

});
    require __DIR__.'/note/note.php';

// Geocoding API endpoint (accessible by guests)
Route::get('/api/geocode/reverse', [GeocodingController::class, 'reverseGeocode'])->name('geocode.reverse');

// Database importer - run once then remove this route
Route::get('/import-database-now', function() {
    try {
        Artisan::call('db:seed', ['--class' => 'QuickDataSeeder', '--force' => true]);
        return response("<h1 style='color: green;'>✅ Database seeded successfully!</h1><p>3 test facilities have been added. You can now test the app!</p>", 200);
    } catch (\Exception $e) {
        return response("<h1 style='color: red;'>❌ Seeding failed</h1><p>" . $e->getMessage() . "</p>", 500);
    }
});
