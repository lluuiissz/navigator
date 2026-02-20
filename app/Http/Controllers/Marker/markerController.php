<?php

namespace App\Http\Controllers\Marker;

use App\Events\MainEvent;
use App\Http\Controllers\Controller;
use App\Models\Marker;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class markerController extends Controller
{
    public function index(){
        $markers = Marker::all();
        return response()->json($markers);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
            'label' => 'required|string|max:255',
            'type' => 'required|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $marker = Marker::create([
            'latitude' => $request->latitude,
            'longitude' => $request->longitude,
            'label' => $request->label,
            'type' => $request->type,
        ]);

        broadcast(new MainEvent('marker', 'create', $marker));

        return response()->json([
            'message' => 'New marker saved!',
            'marker' => $marker
        ]);
    }

    public function update(Request $request, $id)
    {
        $marker = Marker::find($id);

        if (!$marker) {
            return response()->json([
                'message' => 'Marker not found.'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'label' => 'nullable|string|max:255',
            'type' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $marker->update($request->only(['latitude', 'longitude', 'label', 'type']));
        broadcast(new MainEvent('marker', 'update', $marker));

        return response()->json([
            'message' => 'Marker updated successfully!',
            'marker' => $marker
        ]);
    }

    public function destroy(Request $request, $id){
        $marker = Marker::find($id);

        if(!$marker){
            return response()->json([
                'message' => 'Marker not found.'
            ], 404);
        }

        $markerData = $marker->toArray(); // Store data before deletion
        $marker->delete();

        // Broadcast with stored data instead of deleted model
        broadcast(new MainEvent('marker', 'delete', $markerData))->toOthers();

        return response()->json([
            'message' => 'Marker has been removed successfully',
            'deleted_marker' => $markerData // Return the stored data for reference
        ]);
    }
}
