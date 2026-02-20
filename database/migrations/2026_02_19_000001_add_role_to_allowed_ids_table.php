<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('allowed_ids', function (Blueprint $table) {
            // 'student' | 'faculty' — distinguishes which pool the ID belongs to
            $table->enum('role', ['student', 'faculty'])->default('student')->after('course');
            $table->index('role');
        });
    }

    public function down(): void
    {
        Schema::table('allowed_ids', function (Blueprint $table) {
            $table->dropIndex(['role']);
            $table->dropColumn('role');
        });
    }
};
