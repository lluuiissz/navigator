<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckAdminRegister
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Check for admin key in query parameter or environment
        $adminKey = $request->query('admin');
        $validAdminKey = env('ADMIN_REGISTER_KEY', 'true');
        
        if($adminKey !== $validAdminKey){
            abort(403, 'Unauthorized access.');
        }
        return $next($request);
    }
}
