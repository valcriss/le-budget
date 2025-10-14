import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './register.html',
  styleUrls: ['./register.css']
})
export class Register {
  onSubmit(evt: Event){
    evt.preventDefault();
    const form = evt.target as HTMLFormElement;
    const data = new FormData(form);
    const email = data.get('email');
    const password = data.get('password');
    console.log('Create account', { email, password });
    // TODO: call registration API
  }
}
