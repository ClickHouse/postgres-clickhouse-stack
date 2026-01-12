start: start.sh
	./$<

stop:
	docker compose down --volumes --remove-orphans

run-sample: sample/start_sample.sh
	cd "$$(dirname "$<")" && "./$$(basename "$<")"

migrate-sample: sample/migrate_data.sh
	cd "$$(dirname "$<")" && "./$$(basename "$<")"
