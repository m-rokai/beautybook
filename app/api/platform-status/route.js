import { NextResponse } from 'next/server';
import { getPlatformStatus } from '../../../lib/platform';

export function GET() {
  return NextResponse.json({
    platform: getPlatformStatus(),
  });
}
