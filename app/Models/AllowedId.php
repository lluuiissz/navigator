<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AllowedId extends Model
{
    protected $fillable = [
        'id_number',
        'full_name',
        'course',
        'role',
        'is_used',
        'used_by_user_id'
    ];

    protected $casts = [
        'is_used' => 'boolean',
    ];

    /** Get the user who used this ID */
    public function user()
    {
        return $this->belongsTo(User::class, 'used_by_user_id');
    }

    /** Scope: unused IDs */
    public function scopeUnused($query)
    {
        return $query->where('is_used', false);
    }

    /** Scope: used IDs */
    public function scopeUsed($query)
    {
        return $query->where('is_used', true);
    }

    /** Scope: student IDs */
    public function scopeStudents($query)
    {
        return $query->where('role', 'student');
    }

    /** Scope: faculty IDs */
    public function scopeFaculty($query)
    {
        return $query->where('role', 'faculty');
    }
}
