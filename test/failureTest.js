const assert = require('chai').assert;
const helper = require('./testHelper');

describe('error', function(){

  this.timeout(10000);

  let boss;

  before(function(finished){
    helper.start()
      .then(dabauce => {
        boss = dabauce;
        finished();
      });
  });

  after(function(finished){
    boss.stop().then(() => finished());
  });

  it('should reject missing id argument', function(finished){
    boss.fail().catch(() => finished());
  });

  it('should fail a job when requested', function(finished){
    this.timeout(3000);

    const jobName = 'will-fail';

    boss.publish(jobName)
      .then(id => boss.fetch(jobName))
      .then(job => boss.fail(job.id))
      .then(() => finished());

  });

  it('should subscribe to a job failure', function(finished){

    this.timeout(3000);

    const jobName = 'subscribe-fail';
    let jobId;

    boss.onComplete(jobName, job => {
      assert.strictEqual(jobId, job.data.request.id);
      assert.strictEqual('failed', job.data.state);
      finished();
    });

    boss.publish(jobName)
      .then(id => jobId = id)
      .then(() => boss.fetch(jobName))
      .then(job => boss.fail(job.id));

  });

  it('should fail a batch of jobs', function(finished){
    const jobName = 'complete-batch';

    Promise.all([
      boss.publish(jobName),
      boss.publish(jobName),
      boss.publish(jobName)
    ])
    .then(() => boss.fetch(jobName, 3))
    .then(jobs => boss.fail(jobs.map(job => job.id)))
    .then(() => finished());
  });

  it('should accept a payload', function(finished){
    const jobName = 'fail-payload';    
    const failPayload = {
      someReason: 'nuna'
    };

    boss.publish(jobName)
      .then(jobId => boss.fail(jobId, failPayload))
      .then(() => boss.fetchCompleted(jobName))
      .then(job => {
        assert.strictEqual(job.data.state, 'failed');
        assert.strictEqual(job.data.response.someReason, failPayload.someReason);
        finished();
      });
  });

  it('subscribe failure via done() should pass error payload to failed job', function(finished){
    const jobName = 'fetchFailureWithPayload';
    const failPayload = 'mah error';

    boss.subscribe(jobName, job => {
        job.done(failPayload)
          .then(() => boss.fetchCompleted(jobName))
          .then(failedJob => {
            assert.strictEqual(failedJob.data.state, 'failed');
            assert.strictEqual(failedJob.data.response.value, failPayload);
            finished();
          })
      })
      .then(() => boss.publish(jobName));

  });


  it('subscribe failure via Promise reject() should pass string wrapped in value prop', function(finished){
    const queue = 'subscribeFailureViaRejectString';
    const failPayload = 'mah error';

    boss.publish(queue)
      .then(() => boss.subscribe(queue, job => Promise.reject(failPayload)));

    boss.onComplete(queue, job => {
      assert.strictEqual(job.data.state, 'failed');
      assert.strictEqual(job.data.response.value, failPayload);
      finished();
    });

  });

  it('subscribe failure via Promise reject() should pass object payload', function(finished){
    const queue = 'subscribeFailureViaRejectObject';
    const something = 'clever';

    boss.publish(queue)
      .then(() => boss.subscribe(queue, job => Promise.reject({something})));

    boss.onComplete(queue, job => {
      assert.strictEqual(job.data.state, 'failed');
      assert.strictEqual(job.data.response.something, something);
      finished();
    });

  });

  it('failure with Error object should get stored in the failure job', function(finished){
    const jobName = 'failWithErrorObj';
    const message = 'a real error!';

      boss.subscribe(jobName, job => {
        return Promise.resolve()
          .then(() => {
            throw new Error(message);
          });
      });

      boss.onComplete(jobName, job => {
          assert.strictEqual(job.data.state, 'failed');
          assert.strictEqual(job.data.response.message.indexOf(message), 0);

          finished();
      });

      boss.publish(jobName);

  });

});



