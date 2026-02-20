<?php

namespace App\Http\Controllers\Guest;

use App\Http\Controllers\Controller;
use App\Models\Guest;
use Illuminate\Http\Request;

class GuestController extends Controller
{
    public function store(Request $request){
        $data = $request->validate([
            'name' => ['required', 'string'],
            'role' => ['required', 'string', 'in:student,faculty,visitor']
        ]);

        $guest = Guest::create($data);

        return response()->json($guest);
    }

}
