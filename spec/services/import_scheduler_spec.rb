require 'spec_helper'

describe ImportScheduler do
  describe ".run" do
    let(:start_time) { Time.local(2012, 8, 22, 11, 0).to_datetime }
    let(:import_schedule_attrs) {
      {:start_datetime => start_time,
       :end_date => Date.parse("2012-08-25"),
       :frequency => 'daily',
       :user => users(:owner),
       :sample_count => 1,
       :truncate => false,
       :workspace => workspaces(:public),
       :source_dataset => datasets(:table),
       :new_table => true
      }
    }
    let(:import_schedule) do
      ImportSchedule.create!(
          import_schedule_attrs.merge(:to_table => 'destination_table'),
          :without_protection => true)
    end

    let(:other_import_schedule) do
      ImportSchedule.create!(
          import_schedule_attrs.merge(:to_table => 'other_destination_table'),
          :without_protection => true)
    end

    def expect_qc_enqueue
      mock(QC.default_queue).enqueue_if_not_queued("ImportExecutor.run", anything) do |_, import_id|
        Import.find(import_id).tap do |import|
          import.import_schedule.should == import_schedule
          import.workspace.should == import_schedule.workspace
          import.to_table.should == import_schedule.to_table
          import.source_dataset_id.should == import_schedule.source_dataset_id
          import.truncate.should == import_schedule.truncate
          import.user_id.should == import_schedule.user_id
          import.sample_count.should == import_schedule.sample_count
        end
      end
    end

    context "with two import schedules" do
      it "schedules the second even if the first raises" do
        Timecop.freeze(start_time - 2.hours) do # use 2.hours to avoid dst problems
          import_schedule.save!
          other_import_schedule.save!

          # make the first import schedule invalid
          import_schedule.update_attribute(:user, nil)
        end

        Timecop.freeze(start_time + 2.hours) do
          mock(QC.default_queue).enqueue_if_not_queued("ImportExecutor.run", anything) do |_, import_id|
            Import.find(import_id).import_schedule.should == other_import_schedule
          end

          ImportScheduler.run
        end
      end
    end

    context "when next import time is set" do
      before do
        ImportSchedule.delete_all # don't run import schedule on fixtures
        Timecop.freeze(start_time - 2.hours) do # use 2.hours to avoid dst problems
          import_schedule.save!
        end
        expect_qc_enqueue
      end

      context "when run before the end date" do
        around do |example|
          Timecop.freeze(start_time + 2.hours) do
            example.call
          end
        end

        it "enqueues a job to execute an import" do
          ImportScheduler.run
        end

        it "sets the next scheduled import" do
          ImportScheduler.run
          import_schedule.reload
          import_schedule.next_import_at.should >= 2.hours.from_now # dst safe
        end
      end

      context "when run after the end date" do
        around do |example|
          Timecop.freeze(start_time + 1.year) do
            example.call
          end
        end

        it "enqueues the job" do
          ImportScheduler.run
        end

        it "does not schedule another import" do
          ImportScheduler.run
          import_schedule.reload
          import_schedule.next_import_at.should be_nil
        end
      end
    end
  end
end
