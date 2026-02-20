<?php

use App\Http\Controllers\Route\RouteController;
use Illuminate\Support\Facades\Route;



// Route management
Route::get('/routes', [RouteController::class, 'index']);
Route::post('/routes', [RouteController::class, 'store']);
Route::get('/routes/{id}', [RouteController::class, 'show']);
Route::put('/routes/{id}', [RouteController::class, 'update']);
Route::delete('/routes/{id}', [RouteController::class, 'destroy']);

// Additional route endpoints
Route::get('/routes/search/between', [RouteController::class, 'getRoutesBetween']);
Route::get('/routes/export/geojson', [RouteController::class, 'exportGeoJSON']);
