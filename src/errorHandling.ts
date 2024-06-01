/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfError } from '@salesforce/core';
import { OclifError } from '@oclif/core/lib/interfaces/errors.js';
import { SfCommandError } from './types.js';
import { removeEmpty } from './util.js';

/**
 *
 * Takes an error and returns an exit code.
 * Logic:
 * - If it looks like a gack, use that code (20)
 * - If it looks like a TypeError, use that code (10)
 * - use the exitCode if it is a number
 * - use the code if it is a number, or 1 if it is present not a number
 * - use the process exitCode
 * - default to 1
 */
export const computeErrorCode = (e: Error | SfError | SfCommandError): number => {
  // regardless of the exitCode, we'll set gacks and TypeError to a specific exit code
  if (errorIsGack(e)) {
    return 20;
  }

  if (errorIsTypeError(e)) {
    return 10;
  }

  if (isOclifError(e) && typeof e.oclif.exit === 'number') {
    return e.oclif.exit;
  }

  if ('exitCode' in e && typeof e.exitCode === 'number') {
    return e.exitCode;
  }

  if ('code' in e) {
    return typeof e.code !== 'number' ? 1 : e.code;
  }

  return typeof process.exitCode === 'number' ? process.exitCode : 1;
};

/** identifies gacks via regex.  Searches the error message, stack, and recursively checks the cause chain */
export const errorIsGack = (error: Error | SfError): boolean => {
  /** see test for samples  */
  const gackRegex = /\d{9,}-\d{3,} \(-?\d{7,}\)/;
  return (
    gackRegex.test(error.message) ||
    (typeof error.stack === 'string' && gackRegex.test(error.stack)) ||
    // recurse down through the error cause tree to find a gack
    ('cause' in error && error.cause instanceof Error && errorIsGack(error.cause))
  );
};

/** identifies TypeError.  Searches the error message, stack, and recursively checks the cause chain */
export const errorIsTypeError = (error: Error | SfError): boolean =>
  error instanceof TypeError ||
  error.name === 'TypeError' ||
  error.message.includes('TypeError') ||
  Boolean(error.stack?.includes('TypeError')) ||
  ('cause' in error && error.cause instanceof Error && errorIsTypeError(error.cause));

export const errorToSfCommandError = (
  codeFromError: number,
  error: Error | SfError | SfCommandError,
  commandName: string
): SfCommandError => ({
  ...removeEmpty({
    code: codeFromError,
    actions: 'actions' in error ? error.actions : null,
    context: ('context' in error ? error.context : commandName) ?? commandName,
    commandName: ('commandName' in error ? error.commandName : commandName) ?? commandName,
    data: 'data' in error ? error.data : null,
    result: 'result' in error ? error.result : null,
  }),
  ...{
    message: error.message,
    name: error.name ?? 'Error',
    status: codeFromError,
    stack: error.stack,
    exitCode: codeFromError,
  },
});

/** custom typeGuard for handling the fact the SfCommand doesn't know about oclif error structure */
const isOclifError = <T extends Error | SfError | SfCommandError>(e: T): e is T & OclifError =>
  'oclif' in e ? true : false;
