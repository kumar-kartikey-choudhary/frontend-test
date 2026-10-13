import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

/** Providers almost every component/service in the app needs (HttpClient, Router) - stubbed for tests. */
export const provideAppTesting = () => [
  provideHttpClient(),
  provideHttpClientTesting(),
  provideRouter([]),
];
