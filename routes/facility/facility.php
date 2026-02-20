<?php

use App\Http\Controllers\Facilty\FacilityController;
use App\Http\Controllers\FacilityPhotoController;
use Illuminate\Support\Facades\Route;


Route::post('/facilities', [FacilityController::class, 'store'])->name('facility.post');
Route::put('/facilities/{id}', [FacilityController::class, 'update'])->name('facility.put');
Route::delete('/facilities/{id}/destroy', [FacilityController::class, 'destroy'])->name('facility.delete');

// Photo routes
Route::get('/facilities/{facility}/photos', [FacilityPhotoController::class, 'index'])->name('facility.photos.index');
Route::post('/facilities/{facility}/photos', [FacilityPhotoController::class, 'store'])->name('facility.photos.store.single');
Route::post('/facilities/{facility}/photos/bulk', [FacilityPhotoController::class, 'storeMultiple'])->name('facility.photos.store');
Route::post('/facilities/{facility}/photos/delete', [FacilityPhotoController::class, 'deleteMultiple'])->name('facility.photos.delete');
