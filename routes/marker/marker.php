<?php

use App\Http\Controllers\Marker\markerController;
use Illuminate\Support\Facades\Route;


Route::get('/markers', [markerController::class, 'index'])->name('markers.get');
Route::post('/markers', [markerController::class, 'store'])->name('markers.post');
Route::put('/markers/{id}', [markerController::class, 'update'])->name('markers.update');
Route::delete('/markers/{id}', [markerController::class, 'destroy'])->name('markers.delete');

