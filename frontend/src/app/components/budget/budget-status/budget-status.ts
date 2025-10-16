import { Component, Input, ElementRef, ViewChild } from '@angular/core';
import { FontAwesomeModule, FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { faPlusCircle, faMinusCircle } from '@fortawesome/free-solid-svg-icons';

@Component({
    selector: 'app-budget-status',
    standalone: true,
    imports: [FontAwesomeModule],
    templateUrl: './budget-status.html',
    styleUrls: ['./budget-status.css']
})
export class BudgetStatus {
    protected readonly icIncomes = faPlusCircle;
    protected readonly icExpenses = faMinusCircle;

    @Input() available?: string | number;
    // show closing animation when true
    closing = false;

    @ViewChild('root', { read: ElementRef, static: true }) root?: ElementRef<HTMLElement>;

    // Called by parent to start close animation. Returns a promise that
    // resolves when the CSS animation 'animationend' fires on the root element.
    // A fallback timeout is used as a safety net.
    startClose(): Promise<void>{
        this.closing = true;
        const el = this.root?.nativeElement;
        if (!el) return Promise.resolve();

        return new Promise((resolve) => {
            let resolved = false;
            const done = ()=>{
                if (resolved) return; resolved = true; resolve();
            };
            const onAnim = (ev: AnimationEvent)=>{
                // only accept animationend from the element itself
                if ((ev.target as HTMLElement) === el) done();
            };
            el.addEventListener('animationend', onAnim as EventListener);
            // fallback: resolve after 500ms in case animationend doesn't fire
            const to = window.setTimeout(()=>{
                el.removeEventListener('animationend', onAnim as EventListener);
                done();
            }, 500);
            // cleanup when resolved
            const cleanup = ()=>{ clearTimeout(to); el.removeEventListener('animationend', onAnim as EventListener); };
            // wrap resolve to cleanup
            const originalResolve = resolve;
            resolve = ()=>{ cleanup(); (originalResolve as any)(); };
        });
    }
}
