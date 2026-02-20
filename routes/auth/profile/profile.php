<?php

use App\Http\Controllers\Auth\AuthController;
use Illuminate\Support\Facades\Route;



Route::get('/profile', [AuthController::class, 'index'])->name('profile.index');
Route::put('/profile/update', [AuthController::class, 'update'])->name('profile.update');
Route::patch('/profile/change-password', [AuthController::class, 'changePassword']);
