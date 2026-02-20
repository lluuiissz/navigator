<?php

namespace App\Http\Controllers;

use App\Events\MainEvent;
use App\Http\Controllers\Controller;
use App\Models\Facility;
use App\Models\FacilityPhoto;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class FacilityPhotoController extends Controller
{
    public function index(Facility $facility): JsonResponse
    {
        try {
            $photos = $facility->photos()
                ->with('guest')
                ->latest()
                ->get()
                ->makeHidden(['path'])
                ->toArray();

            return response()->json([
                'photos' => $photos,
            ], 200);
        } catch (\Throwable $throwable) {
            Log::error('Failed to fetch facility photos', [
                'error' => $throwable->getMessage(),
                'facility_id' => $facility->id,
            ]);

            return response()->json([
                'message' => 'Failed to fetch photos.',
                'error' => $throwable->getMessage()
            ], 500);
        }
    }

    public function store(Request $request, Facility $facility): JsonResponse
    {
        $validated = $request->validate([
            'photo' => ['required', 'image', 'max:5120'],
            'caption' => ['nullable', 'string', 'max:255'],
            'guest_id' => ['nullable', 'exists:guests,id'],
        ]);

        try {
            $path = $request->file('photo')->store('facility-photos', 'public');

            $photo = FacilityPhoto::create([
                'facility_id' => $facility->id,
                'guest_id' => $validated['guest_id'] ?? null,
                'caption' => $validated['caption'] ?? null,
                'path' => $path,
            ])->load('guest');

            broadcast(new MainEvent('photo', 'create', $photo))->toOthers();

            return response()->json([
                'message' => 'Photo uploaded successfully.',
                'photo' => $photo,
            ], 201);
        } catch (\Throwable $throwable) {
            Log::error('Failed to store facility photo', [
                'error' => $throwable->getMessage(),
                'facility_id' => $facility->id,
            ]);

            return response()->json([
                'message' => 'Failed to upload photo.',
            ], 500);
        }
    }

    public function storeMultiple(Request $request, Facility $facility): JsonResponse
    {
        $validated = $request->validate([
            'photos' => ['required', 'array'],
            'photos.*' => ['required', 'image', 'max:5120'],
        ]);

        try {
            $uploadedPhotos = [];

            foreach ($validated['photos'] as $photo) {
                $path = $photo->store('facility-photos', 'public');

                $facilityPhoto = FacilityPhoto::create([
                    'facility_id' => $facility->id,
                    'path' => $path,
                ])->load('guest');

                $uploadedPhotos[] = $facilityPhoto;
            }

            broadcast(new MainEvent('photos', 'create', $uploadedPhotos))->toOthers();

            return response()->json([
                'message' => 'Photos uploaded successfully.',
                'photos' => $uploadedPhotos,
            ], 201);
        } catch (\Throwable $throwable) {
            Log::error('Failed to store facility photos', [
                'error' => $throwable->getMessage(),
                'facility_id' => $facility->id,
            ]);

            return response()->json([
                'message' => 'Failed to upload photos.',
            ], 500);
        }
    }

    public function deleteMultiple(Request $request, Facility $facility): JsonResponse
    {
        $validated = $request->validate([
            'photo_ids' => ['required', 'array'],
            'photo_ids.*' => ['required', 'integer', 'exists:facility_photos,id'],
        ]);

        try {
            FacilityPhoto::whereIn('id', $validated['photo_ids'])
                ->where('facility_id', $facility->id)
                ->delete();

            broadcast(new MainEvent('photos', 'delete', $validated['photo_ids']))->toOthers();

            return response()->json([
                'message' => 'Photos deleted successfully.',
            ], 200);
        } catch (\Throwable $throwable) {
            Log::error('Failed to delete facility photos', [
                'error' => $throwable->getMessage(),
                'facility_id' => $facility->id,
            ]);

            return response()->json([
                'message' => 'Failed to delete photos.',
            ], 500);
        }
    }
    }

