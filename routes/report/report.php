<?php

use App\Http\Controllers\Report\ReportController;
use Illuminate\Support\Facades\Route;


Route::post('/reports/usage', [ReportController::class, 'generateUsageReport'])->name('reports.usage');
    Route::post('/reports/feedback', [ReportController::class, 'generateFeedbackReport'])->name('reports.feedback');
    Route::post('/reports/facility', [ReportController::class, 'generateFacilityReport'])->name('reports.facility');
    Route::post('/reports/search-trends', [ReportController::class, 'generateSearchTrendsReport'])->name('reports.search-trends');
    Route::get('/reports', [ReportController::class, 'dashboard'])->name('reports.dashboard');
    Route::get('/reports/{report}', [ReportController::class, 'show'])->name('reports.show');
    Route::delete('/reports/{report}', [ReportController::class, 'destroy'])->name('reports.destroy');
