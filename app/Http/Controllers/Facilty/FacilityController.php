<?php

namespace App\Http\Controllers\Facilty;

use App\Http\Controllers\Controller;
use App\Models\Facility;
use App\Events\MainEvent;
use Illuminate\Http\Request;
use Inertia\Inertia;

class FacilityController extends Controller
{

    public function store(Request $request){
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'category' => 'required|string|max:255',
            'department' => 'required|string|max:255',
            'description' => 'nullable|string',
            'floor_number' => 'nullable|string|max:255',
            'hours' => 'nullable|string|max:255',
            'marker_id' => 'nullable|exists:markers,id',
            'status' => 'nullable|in:active,inactive',
        ]);

        $facility = Facility::create($data);

        // Broadcast facility creation event
        broadcast(new MainEvent('facility', 'create', $facility))->toOthers();

        return response()->json([
            'message' => 'Facility created successfully.',
            'facility' => $facility
        ]);
    }
    public function update(Request $request, $id){
        $facility = Facility::findOrFail($id);

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'category' => 'required|string|max:255',
            'department' => 'required|string|max:255',
            'description' => 'nullable|string',
            'floor_number' => 'nullable|string|max:255',
            'hours' => 'nullable|string|max:255',
            'marker_id' => 'nullable|exists:markers,id',
            'status' => 'nullable|in:active,inactive',
        ]);

        $facility->update($data);

        // Broadcast facility update event
        broadcast(new MainEvent('facility', 'update', $facility))->toOthers();

       return response()->json([
            'message' => 'Facility updated successfully.',
            'facility' => $facility
        ]);
    }
    public function destroy($id){
        $facility = Facility::findOrFail($id);
        $facilityData = $facility->toArray(); // Store data before deletion
        $facility->delete();

        // Broadcast facility deletion event with stored data
        broadcast(new MainEvent('facility', 'delete', $facilityData))->toOthers();

       return response()->json([
            'message' => 'Facility deleted successfully.'
        ]);
    }
}
