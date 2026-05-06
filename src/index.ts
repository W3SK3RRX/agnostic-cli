#!/usr/bin/env bun
import { Command } from 'commander'

const program = new Command()
program.name('agnostic').description('Bootstrap de projetos com agentes Claude Code').version('0.1.0')

program.parse()
