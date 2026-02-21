<?php

namespace App\Http\Controllers\Feedback;

use App\Events\MainEvent;
use App\Http\Controllers\Controller;
use App\Models\AllowedId;
use App\Models\Feedback;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class FeedbackController extends Controller
{
    public function store(Request $request)
    {
        // Must be authenticated for any role
        if (!auth()->check()) {
            return response()->json([
                'error' => 'You must be logged in to submit feedback',
            ], 401);
        }

        Log::info('Feedback Request:', $request->all());

        $data = $request->validate([
            'marker_id' => ['required', 'exists:markers,id'],
            'message'   => ['required', 'string'],
        ]);

        $user  = auth()->user();
        $guest = $user->guest;

        if (!$guest) {
            return response()->json([
                'error' => 'Guest record not found for this user',
            ], 404);
        }

        // ─── Role-based feedback gate ───────────────────────────────────────
        // student & faculty  → must have a used allowlist entry
        // visitor            → allowed freely (no ID on allowlist)
        // ──────────────────────────────────────────────────────────────────
        if ($user->role === 'visitor') {
            // Visitors are always permitted
        } elseif (in_array($user->role, ['student', 'faculty'])) {
            $allowedId = AllowedId::where('id_number', $user->id_number)
                ->where('is_used', true)
                ->first();

            if (!$allowedId) {
                return response()->json([
                    'error'   => 'Your ID is not authorized to submit feedback.',
                    'details' => 'Please contact the administrator if you believe this is an error.',
                ], 403);
            }
        } else {
            // Unknown role — deny
            return response()->json(['error' => 'Unauthorized role.'], 403);
        }

        $data['guest_id'] = $guest->id;

        $feedback = Feedback::create($data)->load('guest');

        // Broadcast is best-effort — a Pusher failure must not block the HTTP response
        try {
            broadcast(new MainEvent('feedback', 'create', $feedback))->toOthers();
        } catch (\Exception $broadcastErr) {
            Log::warning('Feedback broadcast failed (non-critical): ' . $broadcastErr->getMessage());
        }

        return response()->json([
            'message'  => 'Feedback added.',
            'feedback' => $feedback,
        ]);
    }
}
