<?php

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\UserActivityController;
use Illuminate\Support\Facades\Route;
use App\Models\Guest;


Route::post('/logout', [AuthController::class, 'logout'])->name('logout');
Route::get('/user/activity', [UserActivityController::class, 'recentActivity'])->name('user.activity');

// Returns (or auto-creates) the guest record for the current authenticated user.
// The frontend calls this as a fallback when page.props.auth.user.guest is null.
Route::get('/api/me/guest', function () {
    $user  = auth()->user();
    $guest = Guest::firstOrCreate(
        ['user_id' => $user->id],
        ['name' => $user->name, 'role' => $user->role ?? 'visitor']
    );
    return response()->json([
        'guest' => [
            'id'   => $guest->id,
            'name' => $guest->name,
            'role' => $guest->role,
        ],
    ]);
})->name('api.me.guest');

