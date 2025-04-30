#!/usr/bin/env node

import { exec } from 'child_process';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('Starting database schema push...');
console.log('This will automatically confirm all schema changes.');

// Execute the drizzle-kit push command
const drizzleProcess = exec('drizzle-kit push');

// Handle drizzle-kit output
drizzleProcess.stdout.on('data', (data) => {
  console.log(data);
  
  // Automatically answer 'create table' for any prompt
  if (data.includes('create table') || data.includes('alter table')) {
    drizzleProcess.stdin.write('\n');
  }
});

drizzleProcess.stderr.on('data', (data) => {
  console.error(`Error: ${data}`);
});

drizzleProcess.on('close', (code) => {
  console.log(`Schema push complete with code ${code}`);
  rl.close();
});