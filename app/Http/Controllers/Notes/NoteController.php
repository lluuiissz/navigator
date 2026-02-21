<?php

namespace App\Http\Controllers\Notes;

use App\Events\MainEvent;
use App\Http\Controllers\Controller;
use App\Models\AllowedId;
use App\Models\Note;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class NoteController extends Controller
{
    public function store(Request $request)
    {
        // Must be authenticated — same gate as FeedbackController
        if (!auth()->check()) {
            return response()->json([
                'error' => 'You must be logged in to add a note',
            ], 401);
        }

        $data = $request->validate([
            'marker_id' => ['required', 'exists:markers,id'],
            'content'   => ['required', 'string', 'max:500'],
        ]);

        $user  = auth()->user();
        $guest = $user->guest;

        if (!$guest) {
            return response()->json([
                'error' => 'Guest record not found for this user',
            ], 404);
        }

        // ─── Role-based gate (mirrors FeedbackController) ────────────────────
        // visitor            → allowed freely
        // student & faculty  → must have a used allowlist entry
        // ─────────────────────────────────────────────────────────────────────
        if ($user->role === 'visitor') {
            // Visitors are always permitted
        } elseif (in_array($user->role, ['student', 'faculty'])) {
            $allowedId = AllowedId::where('id_number', $user->id_number)
                ->where('is_used', true)
                ->first();

            if (!$allowedId) {
                return response()->json([
                    'error'   => 'Your ID is not authorized to add notes.',
                    'details' => 'Please contact the administrator if you believe this is an error.',
                ], 403);
            }
        } else {
            return response()->json(['error' => 'Unauthorized role.'], 403);
        }

        $data['guest_id'] = $guest->id;

        try {
            $note = Note::create($data)->load('guest', 'marker');

            // Broadcast is best-effort — a Pusher failure must not block the note save
            try {
                broadcast(new MainEvent('note', 'create', $note))->toOthers();
            } catch (\Exception $broadcastErr) {
                Log::warning('Note broadcast failed (non-critical): ' . $broadcastErr->getMessage());
            }

            return response()->json([
                'message' => 'Note created successfully.',
                'note'    => $note,
            ], 201);
        } catch (\Exception $e) {
            Log::error('Note creation failed:', [
                'error'   => $e->getMessage(),
                'user_id' => $user->id,
            ]);

            return response()->json([
                'message' => 'Failed to create note.',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    public function destroy($id)
    {
        if (!auth()->check()) {
            return response()->json(['error' => 'Unauthenticated.'], 401);
        }

        $note = Note::find($id);

        if (!$note) {
            return response()->json(['message' => 'Note not found.'], 404);
        }

        // Only the note's author (guest) or an admin can delete
        $user  = auth()->user();
        $guest = $user->guest;

        if ($guest && $note->guest_id !== $guest->id) {
            return response()->json(['error' => 'You can only delete your own notes.'], 403);
        }

        $note->delete();

        return response()->json(['message' => 'Note deleted successfully.']);
    }
}
