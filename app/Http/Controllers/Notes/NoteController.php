<?php

namespace App\Http\Controllers\Notes;

use App\Events\MainEvent;
use App\Http\Controllers\Controller;
use App\Models\Note;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class NoteController extends Controller
{
   public function store(Request $request)
    {

        // Validate the request
        $validated = $request->validate([
            'guest_id' => ['required', 'exists:guests,id'],
            'marker_id' => ['required', 'exists:markers,id'],
            'content' => ['required', 'string', 'max:500'],
        ]);
        try {
            $note = Note::create($validated)->load('guest');

            broadcast(new MainEvent('note', 'create', $note))->toOthers();
            return response()->json([
                'message' => 'Note created successfully.',
                'note' => $note
            ], 201);
        } catch (\Exception $e) {
            Log::error('Note creation failed:', [
                'error' => $e->getMessage(),
                'request' => $request->all()
            ]);

            return response()->json([
                'message' => 'Failed to create note.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function destroy($id)
    {
        $note = Note::find($id);

        if (!$note) {
            return response()->json(['message' => 'Note not found.'], 404);
        }

        $note->delete();

        return response()->json(['message' => 'Note deleted successfully.']);
    }

}
