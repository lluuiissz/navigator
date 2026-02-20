<?php

namespace App\Http\Controllers\Route;

use App\Events\MainEvent;
use App\Http\Controllers\Controller;
use App\Models\Route;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class RouteController extends Controller
{
    /**
     * Display all routes.
     */
    public function index()
    {
        try {
            $routes = Route::orderBy('created_at', 'desc')->get();
            return response()->json($routes);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to fetch routes',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Store a new route.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'start_lat' => 'required|numeric|between:-90,90',
            'start_lng' => 'required|numeric|between:-180,180',
            'end_lat' => 'required|numeric|between:-90,90',
            'end_lng' => 'required|numeric|between:-180,180',
            'estimated_time' => 'required|string|max:100',
            'path_data' => 'required|array|min:2',
            'path_data.*.lat' => 'required|numeric|between:-90,90',
            'path_data.*.lng' => 'required|numeric|between:-180,180',
            'color' => 'nullable|string|regex:/^#[0-9A-Fa-f]{6}$/',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $route = Route::create([
                'start_lat' => $request->start_lat,
                'start_lng' => $request->start_lng,
                'end_lat' => $request->end_lat,
                'end_lng' => $request->end_lng,
                'estimated_time' => $request->estimated_time,
                'path_data' => $request->path_data,
                'color' => $request->color ?? '#3B82F6',
            ]);

            broadcast(new MainEvent('route', 'create', $route));

            return response()->json($route, 201);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to create route',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Show a specific route.
     */
    public function show($id)
    {
        try {
            $route = Route::findOrFail($id);
            return response()->json($route);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Route not found',
                'error' => $e->getMessage()
            ], 404);
        }
    }

    /**
     * Update an existing route.
     */
    public function update(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'start_lat' => 'sometimes|required|numeric|between:-90,90',
            'start_lng' => 'sometimes|required|numeric|between:-180,180',
            'end_lat' => 'sometimes|required|numeric|between:-90,90',
            'end_lng' => 'sometimes|required|numeric|between:-180,180',
            'estimated_time' => 'sometimes|required|string|max:100',
            'path_data' => 'sometimes|required|array|min:2',
            'path_data.*.lat' => 'required_with:path_data|numeric|between:-90,90',
            'path_data.*.lng' => 'required_with:path_data|numeric|between:-180,180',
            'color' => 'nullable|string|regex:/^#[0-9A-Fa-f]{6}$/',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $route = Route::findOrFail($id);

            $updateData = $request->only([
                'start_lat',
                'start_lng',
                'end_lat',
                'end_lng',
                'estimated_time',
                'path_data',
                'color',
            ]);

            $route->update($updateData);

            broadcast(new MainEvent('route', 'update', $route));
            return response()->json($route);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to update route',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete a route.
     */
    public function destroy($id)
    {
        try {
            $route = Route::findOrFail($id);
            $routeData = $route->toArray(); // Store data before deletion
            $route->delete();

            // Broadcast with the stored data instead of deleted model
            broadcast(new MainEvent('route', 'delete', $routeData))->toOthers();

            return response()->json(['message' => 'Route deleted successfully']);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to delete route',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get routes near a given start & end coordinate range (optional feature).
     */
    public function getRoutesBetween(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'start_lat' => 'required|numeric|between:-90,90',
            'start_lng' => 'required|numeric|between:-180,180',
            'end_lat' => 'required|numeric|between:-90,90',
            'end_lng' => 'required|numeric|between:-180,180',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            // Simple coordinate proximity search (±0.01 deg tolerance)
            $routes = Route::whereBetween('start_lat', [$request->start_lat - 0.01, $request->start_lat + 0.01])
                ->whereBetween('start_lng', [$request->start_lng - 0.01, $request->start_lng + 0.01])
                ->whereBetween('end_lat', [$request->end_lat - 0.01, $request->end_lat + 0.01])
                ->whereBetween('end_lng', [$request->end_lng - 0.01, $request->end_lng + 0.01])
                ->get();

            return response()->json($routes);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to fetch routes',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Export all routes as GeoJSON.
     */
    public function exportGeoJSON()
    {
        try {
            $routes = Route::all();

            $features = $routes->map(function ($route) {
                return [
                    'type' => 'Feature',
                    'properties' => [
                        'id' => $route->id,
                        'estimated_time' => $route->estimated_time,
                        'start_lat' => $route->start_lat,
                        'start_lng' => $route->start_lng,
                        'end_lat' => $route->end_lat,
                        'end_lng' => $route->end_lng,
                        'color' => $route->color ?? '#3B82F6',
                    ],
                    'geometry' => [
                        'type' => 'LineString',
                        'coordinates' => array_map(function ($point) {
                            return [$point['lng'], $point['lat']];
                        }, $route->path_data)
                    ]
                ];
            });

            return response()->json([
                'type' => 'FeatureCollection',
                'features' => $features
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to export GeoJSON',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
