<?php

use App\Http\Controllers\UIRenderer\RenderController;
use Illuminate\Support\Facades\Route;


Route::get('/search-logs', [RenderController::class, 'searchlog'])->name('search.logs');
