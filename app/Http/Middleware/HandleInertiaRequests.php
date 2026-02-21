<?php

namespace App\Http\Middleware;

use App\Models\Guest;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     * Ensures every authenticated user has a linked Guest record.
     */
    public function share(Request $request): array
    {
        $user = $request->user();

        if ($user) {
            // Auto-create a guest record if one doesn't exist yet
            // (handles users registered before the user_id column was added)
            $guest = Guest::firstOrCreate(
                ['user_id' => $user->id],
                [
                    'name' => $user->name,
                    'role' => $user->role ?? 'visitor',
                ]
            );

            // Attach the guest to the user model for this request
            $user->setRelation('guest', $guest);
        }

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $user ? $user->load('guest') : null,
            ],
        ];
    }
}
