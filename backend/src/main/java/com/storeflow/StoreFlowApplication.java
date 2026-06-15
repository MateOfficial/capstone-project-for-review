package com.storeflow;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class StoreFlowApplication {

    public static void main(String[] args) {
        SpringApplication.run(StoreFlowApplication.class, args);
    }
}
