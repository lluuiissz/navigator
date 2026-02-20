<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;

class GeocodingController extends Controller
{
    public function reverseGeocode(Request $request)
    {
        $request->validate([
            'lat' => 'required|numeric',
            'lng' => 'required|numeric',
        ]);

        $lat = $request->input('lat');
        $lng = $request->input('lng');

        // Create cache key based on coordinates (rounded to 6 decimals)
        $cacheKey = 'geocode_' . round($lat, 6) . '_' . round($lng, 6);

        // Check cache first (cache for 30 days)
        $cachedResult = Cache::get($cacheKey);
        if ($cachedResult) {
            return response()->json($cachedResult);
        }

        try {
            // Call Nominatim API with proper headers
            $response = Http::timeout(10)
                ->withHeaders([
                    'User-Agent' => 'ICNS-Campus-Navigator/1.0 (contact@asscatccis.com)',
                    'Accept-Language' => 'en',
                ])
                ->get('https://nominatim.openstreetmap.org/reverse', [
                    'format' => 'json',
                    'lat' => $lat,
                    'lon' => $lng,
                    'zoom' => 18,
                    'addressdetails' => 1,
                ]);

            if ($response->successful()) {
                $data = $response->json();

                // Extract city and province
                $address = $data['address'] ?? [];
                $parts = [];

                // Get city/municipality/town/village
                $city = $address['municipality']
                    ?? $address['city']
                    ?? $address['town']
                    ?? $address['village']
                    ?? null;

                if ($city) {
                    $parts[] = $city;
                }

                // Get province/state
                $province = $address['state'] ?? $address['province'] ?? null;
                if ($province) {
                    $parts[] = $province;
                }

                $result = [
                    'success' => true,
                    'address' => count($parts) > 0 ? implode(' • ', $parts) : 'Location',
                    'full_data' => $data
                ];

                // Cache the result for 30 days
                Cache::put($cacheKey, $result, now()->addDays(30));

                return response()->json($result);
            }

            return response()->json([
                'success' => false,
                'address' => 'Location',
                'error' => 'Geocoding service unavailable'
            ], 503);

        } catch (\Exception $e) {
            \Log::error('Geocoding error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'address' => 'Location',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
