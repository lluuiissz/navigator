<?php

namespace App\Http\Controllers\Logs;

use App\Http\Controllers\Controller;
use App\Models\SearchLog;
use Illuminate\Http\Request;

class SearchLogsController extends Controller
{
 public function store(Request $request)
{
    try {
        $validated = $request->validate([
            'guest_id' => 'required|integer|exists:guests,id',
            'query' => 'required|string|max:255',
            'search_at' => 'required|date',
        ]);

        $searchLog = SearchLog::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Search logged successfully',
            'data' => $searchLog
        ]);
    } catch (\Throwable $e) {
        return response()->json([
            'error' => true,
            'message' => $e->getMessage()
        ], 500);
    }
}


}
