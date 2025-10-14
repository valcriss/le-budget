import { Component } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { RouterLink } from '@angular/router';
import { faRightToBracket } from '@fortawesome/free-solid-svg-icons';
import { faGoogle, faFacebookF } from '@fortawesome/free-brands-svg-icons';

@Component({
  selector: 'app-login-page',
  imports: [FontAwesomeModule, RouterLink],
  templateUrl: './login-page.html',
  styleUrls: ['./login-page.css']
})
export class LoginPage {
  // expose icons to template
  protected readonly faGoogle = faGoogle;
  protected readonly faFacebook = faFacebookF;
  protected readonly faLogin = faRightToBracket;

  constructor(library: FaIconLibrary) {
    // optional: add icons to the library for convenience
    library.addIcons(faGoogle, faFacebookF, faRightToBracket);
  }
  onSubmit(evt: Event){
    evt.preventDefault();
    // récupérer les valeurs du formulaire si besoin
    const form = (evt.target as HTMLFormElement);
    const data = new FormData(form);
    const email = data.get('email');
    // ici, ajouter la logique d'authentification
    console.log('Login submit', {email});
  }

  onGoogleSignIn(){
    console.log('Google signin');
    // appeler le flow d'authentification Google
  }

  onFacebookSignIn(){
    console.log('Facebook signin');
    // appeler le flow d'authentification Facebook
  }

  onCreateAccount(evt: Event){
    evt.preventDefault();
    console.log('Navigate to create account');
  }

  onForgotPassword(evt: Event){
    evt.preventDefault();
    console.log('Forgot password');
  }
}
