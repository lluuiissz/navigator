<?php

namespace App\Http\Controllers;

use App\Models\FacilityPolygon;
use Illuminate\Http\Request;
use App\Events\MainEvent;

class FacilityPolygonController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $polygons = FacilityPolygon::all();
        return response()->json($polygons);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'type' => 'required|string|max:100',
            'color' => 'required|string|max:7',
            'fill_color' => 'required|string|max:7',
            'fill_opacity' => 'required|numeric|min:0|max:1',
            'coordinates' => 'required|array|min:3',
            'coordinates.*.lat' => 'required|numeric',
            'coordinates.*.lng' => 'required|numeric',
        ]);

        $polygon = FacilityPolygon::create($validated);

        // Broadcast polygon creation
        broadcast(new MainEvent('polygon', 'created', $polygon->id))->toOthers();

        return response()->json($polygon, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(FacilityPolygon $facilityPolygon)
    {
        return response()->json($facilityPolygon);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, FacilityPolygon $facilityPolygon)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'type' => 'required|string|max:100',
            'color' => 'required|string|max:7',
            'fill_color' => 'required|string|max:7',
            'fill_opacity' => 'required|numeric|min:0|max:1',
            'coordinates' => 'required|array|min:3',
            'coordinates.*.lat' => 'required|numeric',
            'coordinates.*.lng' => 'required|numeric',
        ]);

        $facilityPolygon->update($validated);

        // Broadcast polygon update
        broadcast(new MainEvent('polygon', 'updated', $facilityPolygon->id))->toOthers();

        return response()->json($facilityPolygon);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(FacilityPolygon $facilityPolygon)
    {
        $id = $facilityPolygon->id;
        $facilityPolygon->delete();

        // Broadcast polygon deletion
        broadcast(new MainEvent('polygon', 'deleted', $id))->toOthers();

        return response()->json(['message' => 'Facility polygon deleted successfully'], 200);
    }
}
