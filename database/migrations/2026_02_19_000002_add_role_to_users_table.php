<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Ensure id_number exists first (nullable for visitors)
        if (!Schema::hasColumn('users', 'id_number')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('id_number')->nullable()->after('email');
            });
        }

        // Add role column
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'role')) {
                // 'student' | 'faculty' | 'visitor' | 'admin'
                $table->enum('role', ['student', 'faculty', 'visitor', 'admin'])
                      ->default('student')
                      ->after('id_number'); // Now guaranteed to exist (or be added above)
                $table->index('role');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'role')) {
                $table->dropIndex(['role']);
                $table->dropColumn('role');
            }
            // We don't drop id_number here as it might have existed before
        });
    }
};
