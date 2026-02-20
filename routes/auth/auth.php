<?php

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\UserActivityController;
use Illuminate\Support\Facades\Route;


Route::post('/logout', [AuthController::class, 'logout'])->name('logout');
Route::get('/user/activity', [UserActivityController::class, 'recentActivity'])->name('user.activity');

