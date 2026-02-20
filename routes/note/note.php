<?php

use App\Http\Controllers\Notes\NoteController;
use Illuminate\Support\Facades\Route;


// Notes routes
Route::post('/create/note', [NoteController::class, 'store']);
Route::delete('/notes/{note}', [NoteController::class, 'destroy']);

