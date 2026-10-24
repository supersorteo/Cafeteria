import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NoticeBanner } from './shared/notice-banner';

@Component({
  imports: [RouterOutlet, NoticeBanner],
  selector: 'app-root',
  template: '<app-notice-banner /><router-outlet />',
})
export class App {}
