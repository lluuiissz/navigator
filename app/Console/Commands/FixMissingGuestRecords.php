<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Models\Guest;
use Illuminate\Console\Command;

class FixMissingGuestRecords extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'fix:missing-guests';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Create Guest records for Users who don\'t have one';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('🔍 Checking for users without guest records...');

        $usersWithoutGuests = User::doesntHave('guest')->get();

        if ($usersWithoutGuests->isEmpty()) {
            $this->info('✅ All users already have guest records!');
            return 0;
        }

        $this->warn("Found {$usersWithoutGuests->count()} users without guest records:");

        foreach ($usersWithoutGuests as $user) {
            $this->line("  - User #{$user->id}: {$user->name} ({$user->email}) - ID#: " . ($user->id_number ?? 'NULL'));
        }

        if (!$this->confirm('Do you want to create guest records for these users?', true)) {
            $this->info('Operation cancelled.');
            return 0;
        }

        $created = 0;
        $failed = 0;

        foreach ($usersWithoutGuests as $user) {
            try {
                Guest::create([
                    'name' => $user->name,
                    'role' => 'student',
                    'user_id' => $user->id
                ]);

                $this->info("✅ Created guest record for User #{$user->id}: {$user->name}");
                $created++;
            } catch (\Exception $e) {
                $this->error("❌ Failed to create guest record for User #{$user->id}: {$e->getMessage()}");
                $failed++;
            }
        }

        $this->newLine();
        $this->info("📊 Summary:");
        $this->info("  ✅ Created: {$created}");
        if ($failed > 0) {
            $this->error("  ❌ Failed: {$failed}");
        }

        return 0;
    }
}
