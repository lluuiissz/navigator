<?php

namespace App\Http\Controllers\Auth;

use App\Events\MainEvent;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\AllowedId;
use App\Models\Guest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class AuthController extends Controller
{
    public function isEmailExist(Request $request)
    {
        $exists = User::where('email', $request->email)->exists();
        return response()->json(['exists' => $exists]);
    }

    /**
     * Verify if ID number exists in allowlist for the given role (student|faculty).
     * The frontend passes ?role=student or ?role=faculty.
     */
    public function verifyIdNumber(Request $request)
    {
        $request->validate([
            'id_number' => 'required|string',
            'role'      => 'required|in:student,faculty',
        ]);

        $allowedId = AllowedId::where('id_number', $request->id_number)
            ->where('role', $request->role)
            ->first();

        if (!$allowedId) {
            return response()->json([
                'exists'  => false,
                'message' => "ID number not found in the {$request->role} allowlist",
            ], 404);
        }

        if ($allowedId->is_used) {
            $user = User::where('id_number', $request->id_number)->first();
            return response()->json([
                'exists'    => true,
                'available' => false,
                'message'   => 'This ID is already registered. Please login.',
                'full_name' => $allowedId->full_name,
                'course'    => $allowedId->course,
                'role'      => $allowedId->role,
                'email'     => $user ? $user->email : null,
            ], 200);
        }

        return response()->json([
            'exists'    => true,
            'available' => true,
            'full_name' => $allowedId->full_name,
            'course'    => $allowedId->course,
            'role'      => $allowedId->role,
        ]);
    }

    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email'    => ['required', 'string', 'email', 'max:255'],
            'password' => ['required', 'string'],
        ]);

        if (!auth()->attempt($credentials)) {
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        $request->session()->regenerate();

        if ($request->expectsJson() || $request->ajax()) {
            $user  = auth()->user();
            $guest = $user->guest;

            return response()->json([
                'success' => true,
                'message' => 'Login successful!',
                'user'    => [
                    'id'        => $user->id,
                    'name'      => $user->name,
                    'email'     => $user->email,
                    'id_number' => $user->id_number,
                    'role'      => $user->role,
                    'guest'     => $guest ? [
                        'id'   => $guest->id,
                        'name' => $guest->name,
                        'role' => $guest->role,
                    ] : null,
                ],
            ]);
        }

        return redirect()->intended('/reports');
    }

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Logged out successfully.']);
    }

    /**
     * Register a student or faculty (requires allowlist ID).
     */
    public function register(Request $request)
    {
        $credentials = $request->validate([
            'name'      => ['required', 'string', 'max:255'],
            'email'     => ['required', 'string', 'email', 'max:255', 'unique:users'],
            'password'  => ['required', 'string', 'confirmed'],
            'id_number' => ['required', 'string', 'exists:allowed_ids,id_number'],
        ]);

        DB::beginTransaction();
        try {
            $allowedId = AllowedId::where('id_number', $credentials['id_number'])->first();

            if (!$allowedId) {
                return back()->withErrors(['id_number' => 'ID number not found in allowlist']);
            }

            if ($allowedId->is_used) {
                return back()->withErrors(['id_number' => 'This ID has already been used']);
            }

            // The user's role matches the allowlist entry's role (student or faculty)
            $userRole = $allowedId->role; // 'student' | 'faculty'

            $user = User::create([
                'name'      => $credentials['name'],
                'email'     => $credentials['email'],
                'password'  => Hash::make($credentials['password']),
                'id_number' => $credentials['id_number'],
                'role'      => $userRole,
            ]);

            $guest = Guest::create([
                'name'    => $credentials['name'],
                'role'    => $userRole,
                'user_id' => $user->id,
            ]);

            $allowedId->update([
                'is_used'          => true,
                'used_by_user_id'  => $user->id,
            ]);

            DB::commit();

            if ($request->expectsJson() || $request->ajax()) {
                Auth::login($user);
                $request->session()->regenerate();

                return response()->json([
                    'success' => true,
                    'message' => 'Registration successful!',
                    'user'    => [
                        'id'        => $user->id,
                        'name'      => $user->name,
                        'email'     => $user->email,
                        'id_number' => $user->id_number,
                        'role'      => $user->role,
                        'guest'     => [
                            'id'   => $guest->id,
                            'name' => $guest->name,
                            'role' => $guest->role,
                        ],
                    ],
                ]);
            }

            return redirect()->route('login')->with('success', 'Registration successful! Please login.');
        } catch (\Exception $e) {
            DB::rollBack();
            return back()->withErrors(['error' => 'Registration failed: ' . $e->getMessage()]);
        }
    }

    /**
     * Register a visitor (name + email only — no ID required).
     * Visitors can submit feedback without being on the allowlist.
     */
    public function registerVisitor(Request $request)
    {
        $credentials = $request->validate([
            'name'     => ['required', 'string', 'max:255'],
            'email'    => ['required', 'string', 'email', 'max:255', 'unique:users'],
            'password' => ['required', 'string', 'confirmed', 'min:8'],
        ]);

        DB::beginTransaction();
        try {
            $user = User::create([
                'name'     => $credentials['name'],
                'email'    => $credentials['email'],
                'password' => Hash::make($credentials['password']),
                'role'     => 'visitor',
            ]);

            $guest = Guest::create([
                'name'    => $credentials['name'],
                'role'    => 'visitor',
                'user_id' => $user->id,
            ]);

            DB::commit();

            if ($request->expectsJson() || $request->ajax()) {
                Auth::login($user);
                $request->session()->regenerate();

                return response()->json([
                    'success' => true,
                    'message' => 'Account created! Welcome, ' . $user->name . '.',
                    'user'    => [
                        'id'    => $user->id,
                        'name'  => $user->name,
                        'email' => $user->email,
                        'role'  => $user->role,
                        'guest' => [
                            'id'   => $guest->id,
                            'name' => $guest->name,
                            'role' => $guest->role,
                        ],
                    ],
                ]);
            }

            return redirect()->route('login')->with('success', 'Account created! Please login.');
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => 'Registration failed: ' . $e->getMessage()], 500);
        }
    }

    public function index()
    {
        $user = Auth::user();
        return Inertia::render('auth/profile/Profile', ['user' => $user]);
    }

    public function update(Request $request)
    {
        $user = Auth::user();

        $validatedData = $request->validate([
            'name'  => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email,' . $user->id,
        ]);

        $user->update($validatedData);
        broadcast(new MainEvent('user', 'update', $user))->toOthers();
        return response()->json(['message' => 'Profile updated successfully.']);
    }

    public function changePassword(Request $request)
    {
        $user = Auth::user();

        $validatedData = $request->validate([
            'current_password' => 'required',
            'new_password'     => 'required|string|min:8|confirmed',
        ]);

        if (!Hash::check($validatedData['current_password'], $user->password)) {
            return response()->json(['message' => 'Current password is incorrect.'], 400);
        }

        $user->password = Hash::make($validatedData['new_password']);
        $user->save();

        return response()->json(['message' => 'Password changed successfully.']);
    }
}
