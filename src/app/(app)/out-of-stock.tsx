import React from 'react';
import { Redirect } from 'expo-router';
import { OUT_OF_STOCK_ID } from '@/features/lists/out-of-stock';

/** Preserve old links; every list now uses the same editor and Collect Mode. */
export default function OutOfStockRoute() {
  return <Redirect href={{ pathname: '/(app)/list/[id]', params: { id: OUT_OF_STOCK_ID } }} />;
}
