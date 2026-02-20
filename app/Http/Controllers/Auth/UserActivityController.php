<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\Feedback;
use Illuminate\Support\Facades\Auth;

class UserActivityController extends Controller
{
    /**
     * Return the authenticated user's recent feedback submissions.
     */
    public function recentActivity()
    {
        $user  = Auth::user();
        $guest = $user->guest;

        if (!$guest) {
            return response()->json(['activities' => []]);
        }

        $feedbacks = Feedback::where('guest_id', $guest->id)
            ->with(['marker.facilities'])
            ->latest()
            ->take(10)
            ->get()
            ->map(fn($f) => [
                'id'            => $f->id,
                'message'       => $f->message,
                'facility_name' => $f->marker?->facilities?->first()?->name ?? 'Unknown facility',
                'marker_id'     => $f->marker_id,
                'created_at'    => $f->created_at?->diffForHumans(),
            ]);

        return response()->json([
            'activities' => $feedbacks,
            'user' => [
                'name'      => $user->name,
                'email'     => $user->email,
                'role'      => $user->role,
                'id_number' => $user->id_number,
            ],
        ]);
    }
}
