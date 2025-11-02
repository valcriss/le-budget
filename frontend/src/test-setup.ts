import '@angular/compiler';
import { provideHttpClient } from '@angular/common/http';
import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

setupZoneTestEnv({
  providers: [provideHttpClient()],
});
