import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Dashboard } from './dashboard';

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dashboard]
    }).compileComponents();

    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load performance data on init', () => {
    component.ngOnInit();
    expect(component.performance.white.games).toBeGreaterThan(0);
    expect(component.performance.black.games).toBeGreaterThan(0);
  });

  it('should display mock performance data', () => {
    expect(component.performance.overall.avgAccuracy).toBe(85);
    expect(component.performance.overall.totalBlunders).toBe(23);
  });
});
