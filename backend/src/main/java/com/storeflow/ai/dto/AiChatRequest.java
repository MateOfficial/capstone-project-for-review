package com.storeflow.ai.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

public class AiChatRequest {

    @NotBlank
    @Size(max = 4000)
    private String message;

    /** Previous conversation turns: [{role: "user"|"assistant", content: "..."}] */
    private List<HistoryMessage> history;

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public List<HistoryMessage> getHistory() { return history; }
    public void setHistory(List<HistoryMessage> history) { this.history = history; }

    public static class HistoryMessage {
        private String role;
        private String content;
        public String getRole() { return role; }
        public void setRole(String role) { this.role = role; }
        public String getContent() { return content; }
        public void setContent(String content) { this.content = content; }
    }
}
