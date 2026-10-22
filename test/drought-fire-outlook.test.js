import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFireOutlook } from '../lib/drought-fire/outlook.js';
import { firePresentation, fireChartMarkup, renderFireCurve } from '../public/js/visuals/fire-curve.js';

const now = Date.parse('2026-10-22T12:30:00Z');
const background = {precipDeficit90d_in:2.04,precipDeficitSeasonal_in:2.65,soilPercentile:27.46};
const current = {rh:93,windGust:2.2,tempF:39.2,tempAnomalyF:-18.7,daysSinceRain:9,rainTodayIn:0,rainRateInHr:0};
const hours = () => Array.from({length:24},(_,i) => ({timestamp:now+(i+0.5)*3600000,
  temperatureF:i<9?68:45,relativeHumidity:i<9?25:85,windGust:i<9?12:3,precipAmount:0}));
const build = hourly => buildFireOutlook({hourly,current,background,now});

test('humid morning remains Low while dry afternoon drives Moderate outlook headline', () => {
  const outlook = build(hours());
  assert.equal(outlook.complete,true);
  assert.ok(outlook.points[0].FRI < 20);
  assert.ok(outlook.peak.FRI >= 20 && outlook.peak.FRI < 40);
  assert.equal(outlook.peak.label,'Moderate');
  assert.ok(outlook.points.every(p => p.DSS === outlook.points[0].DSS));
  assert.ok(outlook.points.at(-1).FRI < outlook.peak.FRI);
  const presentation = firePresentation({FRI:outlook.points[0].FRI,outlook});
  assert.match(presentation.headline,/Moderate.*next 24 hours/);
  assert.equal(presentation.value,outlook.peak.FRI);
  assert.match(presentation.summary,/Current potential: .*\(low\)/);
});

test('missing hours and null weather values cannot create a full-window peak claim', () => {
  for (const broken of [[], hours().filter((_,i)=>i!==5), hours().map((h,i)=>i===4?{...h,relativeHumidity:null}:h)]) {
    const outlook = build(broken);
    assert.equal(outlook.complete,false);
    assert.equal(outlook.peak,null);
    const presentation = firePresentation({FRI:13,outlook});
    assert.equal(presentation.value,13);
    assert.match(presentation.summary,/unavailable/);
  }
});

test('future rain only lowers future scores; past and beyond-window hours excluded', () => {
  const dry = build(hours());
  const wet = build(hours().map((h,i)=>({...h,precipAmount:i===0?0.5:0})));
  assert.equal(wet.points[0].FRI,dry.points[0].FRI);
  assert.ok(wet.peak.FRI < dry.peak.FRI);
  assert.ok(wet.points.every(p => p.DSS === dry.points[0].DSS));
  const outside = [{...hours()[0],timestamp:now-3600000},...hours(),{...hours()[0],timestamp:now+25*3600000}];
  assert.deepEqual(build(outside),dry);
});

test('chart uses shared 0–100 scale, distinct lines, accessible summary and no invalid coordinates', () => {
  const outlook = build(hours());
  for(const width of [280,360,860]) {
    const markup=fireChartMarkup(outlook,{width,selected:7});
    assert.match(markup,new RegExp(`viewBox="0 0 ${width} 250"`));
    assert.match(markup,/stroke-dasharray="7 5"/);
    assert.match(markup,/Peak fire potential/);
    assert.match(markup,/>100<\/text>/);
    assert.doesNotMatch(markup,/NaN|Infinity|undefined/);
  }
  assert.equal(fireChartMarkup({points:[]}), '');
});

test('hour slider and hover expose the selected conditions; failed refresh clears the chart', () => {
  const plot = {clientWidth:340,innerHTML:'',events:{},addEventListener(name,fn){this.events[name]=fn;},getBoundingClientRect(){return {left:0,width:340};}};
  const inspect = {innerHTML:''};
  const slider = {value:0,events:{},attrs:{},addEventListener(name,fn){this.events[name]=fn;},setAttribute(k,v){this.attrs[k]=v;}};
  const target = {innerHTML:'',querySelector(s){return s==='input'?slider:s==='.fire-curve-plot'?plot:inspect;}};
  const outlook = build(hours());
  renderFireCurve(target,outlook);
  assert.match(inspect.innerHTML,/Moderate/);
  slider.value=0;
  slider.events.input();
  assert.match(inspect.innerHTML,/Now · observed/);
  assert.match(slider.attrs['aria-valuetext'],/Low/);
  slider.value=24;
  slider.events.input();
  assert.match(inspect.innerHTML,/forecast/);
  assert.match(slider.attrs['aria-valuetext'],/humidity 85 percent/);
  plot.events.pointermove({pointerType:'mouse',clientX:34});
  assert.match(inspect.innerHTML,/Now · observed/);
  renderFireCurve(target,null);
  assert.match(target.innerHTML,/Hourly outlook unavailable/);
  assert.doesNotMatch(target.innerHTML,/<svg|type="range"/);
});
