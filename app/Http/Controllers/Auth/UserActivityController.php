<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\Feedback;
use App\Models\Note;
use Illuminate\Support\Facades\Auth;

class UserActivityController extends Controller
{
    /**
     * Return the authenticated user's recent activity:
     * both feedback submissions and notes, merged and sorted by date.
     */
    public function recentActivity()
    {
        $user  = Auth::user();
        $guest = $user->guest;

        if (!$guest) {
            return response()->json([
                'activities' => [],
                'user'       => [
                    'name'      => $user->name,
                    'email'     => $user->email,
                    'role'      => $user->role,
                    'id_number' => $user->id_number,
                ],
            ]);
        }

        // ── Feedback ───────────────────────────────────────────────────────────
        $feedbacks = Feedback::where('guest_id', $guest->id)
            ->with(['marker.facilities'])
            ->latest()
            ->take(10)
            ->get()
            ->map(fn($f) => [
                'id'            => $f->id,
                'type'          => 'feedback',
                'text'          => $f->message,
                'facility_name' => $f->marker?->facilities?->first()?->name ?? $f->marker?->label ?? 'Unknown location',
                'marker_id'     => $f->marker_id,
                'created_at'    => $f->created_at?->diffForHumans(),
                'created_raw'   => $f->created_at,
            ]);

        // ── Notes ──────────────────────────────────────────────────────────────
        $notes = Note::where('guest_id', $guest->id)
            ->with(['marker'])
            ->latest()
            ->take(10)
            ->get()
            ->map(fn($n) => [
                'id'            => $n->id,
                'type'          => 'note',
                'text'          => $n->content,
                'facility_name' => $n->marker?->label ?? 'Unknown location',
                'marker_id'     => $n->marker_id,
                'created_at'    => $n->created_at?->diffForHumans(),
                'created_raw'   => $n->created_at,
            ]);

        // ── Merge and sort by most recent ──────────────────────────────────────
        $activities = $feedbacks->merge($notes)
            ->sortByDesc('created_raw')
            ->take(10)
            ->values()
            ->map(fn($item) => collect($item)->except('created_raw')->all());

        return response()->json([
            'activities' => $activities,
            'user'       => [
                'name'      => $user->name,
                'email'     => $user->email,
                'role'      => $user->role,
                'id_number' => $user->id_number,
            ],
        ]);
    }
}
