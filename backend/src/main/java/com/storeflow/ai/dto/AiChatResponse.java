package com.storeflow.ai.dto;

public class AiChatResponse {

    private String reply;
    private boolean success;
    private String error;

    public static AiChatResponse ok(String reply) {
        AiChatResponse r = new AiChatResponse();
        r.reply = reply;
        r.success = true;
        return r;
    }

    public static AiChatResponse fail(String error) {
        AiChatResponse r = new AiChatResponse();
        r.error = error;
        r.success = false;
        return r;
    }

    public String getReply() { return reply; }
    public boolean isSuccess() { return success; }
    public String getError() { return error; }
}
