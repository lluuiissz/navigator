<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class QuickDataSeeder extends Seeder
{
    public function run()
    {
        // Insert just a few key facilities for testing
        DB::table('facilities')->insert([
            [
                'name' => 'Library',
                'category' => 'Educational',
                'department' => 'Academics',
                'description' => 'A place where students can study and access academic resources.',
                'floor_number' => null,
                'hours' => '8:00 AM - 5:00 PM',
                'status' => 'active',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Gymnasium',
                'category' => 'Sports',
                'department' => 'Physical Education',
                'description' => 'Indoor facility for sports events and student activities.',
                'floor_number' => null,
                'hours' => '6:00 AM - 9:00 PM',
                'status' => 'active',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Cafeteria',
                'category' => 'Food & Beverage',
                'department' => 'Student Services',
                'description' => 'Serves meals and refreshments for students and staff.',
                'floor_number' => null,
                'hours' => '7:00 AM - 7:00 PM',
                'status' => 'active',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
        
        $this->command->info('✅ Quick data seeded successfully!');
    }
}
